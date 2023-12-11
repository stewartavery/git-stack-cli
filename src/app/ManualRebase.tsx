import * as React from "react";

import * as Ink from "ink";

import * as CommitMetadata from "../core/CommitMetadata.js";
import * as Metadata from "../core/Metadata.js";
import * as StackSummaryTable from "../core/StackSummaryTable.js";
import { cli } from "../core/cli.js";
import { colors } from "../core/colors.js";
import * as github from "../core/github.js";
import { invariant } from "../core/invariant.js";
import { short_id } from "../core/short_id.js";

import { Await } from "./Await.js";
import { Brackets } from "./Brackets.js";
import { FormatText } from "./FormatText.js";
import { Store } from "./Store.js";

type Props = {
  skipSync?: boolean;
};

export function ManualRebase(props: Props) {
  return (
    <Await
      fallback={<Ink.Text color={colors.yellow}>Rebasing commits...</Ink.Text>}
      function={() => run(props)}
    />
  );
}

async function run(props: Props) {
  const state = Store.getState();
  const actions = state.actions;
  const argv = state.argv;
  const branch_name = state.branch_name;
  const merge_base = state.merge_base;
  const commit_map = state.commit_map;

  invariant(argv, "argv must exist");
  invariant(branch_name, "branch_name must exist");
  invariant(merge_base, "merge_base must exist");
  invariant(commit_map, "commit_map must exist");

  // always listen for SIGINT event and restore git state
  process.once("SIGINT", handle_exit);

  const temp_branch_name = `${branch_name}_${short_id()}`;

  const commit_range = await CommitMetadata.range(commit_map);

  // reverse commit list so that we can cherry-pick in order
  commit_range.group_list.reverse();

  let rebase_merge_base = merge_base;
  let rebase_group_index = 0;

  for (let i = 0; i < commit_range.group_list.length; i++) {
    const group = commit_range.group_list[i];

    if (!group.dirty) {
      continue;
    }

    if (i > 0) {
      const last_group = commit_range.group_list[i - 1];
      const last_commit = last_group.commits[last_group.commits.length - 1];
      rebase_merge_base = last_commit.sha;
      rebase_group_index = i;
    }

    break;
  }

  try {
    // create temporary branch based on merge base
    await cli(`git checkout -b ${temp_branch_name} ${rebase_merge_base}`);

    const pr_url_list = commit_range.group_list.map(get_group_url);

    for (let i = rebase_group_index; i < commit_range.group_list.length; i++) {
      const group = commit_range.group_list[i];

      invariant(group.base, "group.base must exist");

      const selected_url = get_group_url(group);

      // cherry-pick and amend commits one by one
      for (const commit of group.commits) {
        const git_cherry_pick_command = [`git cherry-pick ${commit.sha}`];

        if (argv.verify === false) {
          git_cherry_pick_command.push("--no-verify");
        }

        await cli(git_cherry_pick_command);

        if (commit.branch_id !== group.id) {
          const new_message = await Metadata.write(commit.message, group.id);
          await cli(`git commit --amend -m "${new_message}"`);
        }
      }

      actions.output(
        <FormatText
          wrapper={<Ink.Text color={colors.yellow} wrap="truncate-end" />}
          message="Syncing {group}…"
          values={{
            group: (
              <Brackets>{group.pr?.title || group.title || group.id}</Brackets>
            ),
          }}
        />
      );

      if (!props.skipSync) {
        // push to origin since github requires commit shas to line up perfectly
        const git_push_command = [`git push -f origin HEAD:${group.id}`];

        if (argv.verify === false) {
          git_push_command.push("--no-verify");
        }

        await cli(git_push_command);

        if (group.pr) {
          // ensure base matches pr in github
          await github.pr_edit({
            branch: group.id,
            base: group.base,
            body: StackSummaryTable.write({
              body: group.pr.body,
              pr_url_list,
              selected_url,
            }),
          });
        } else {
          // delete local group branch if leftover
          await cli(`git branch -D ${group.id}`, { ignoreExitCode: true });

          // move to temporary branch for creating pr
          await cli(`git checkout -b ${group.id}`);

          // create pr in github
          const pr_url = await github.pr_create({
            branch: group.id,
            base: group.base,
            title: group.title,
            body: "",
          });

          if (!pr_url) {
            throw new Error("unable to create pr");
          }

          // update pr_url_list with created pr_url
          for (let i = 0; i < pr_url_list.length; i++) {
            const url = pr_url_list[i];
            if (url === selected_url) {
              pr_url_list[i] = pr_url;
            }
          }

          // move back to temp branch
          await cli(`git checkout ${temp_branch_name}`);
        }
      }
    }

    // finally, ensure all prs have the updated stack table from updated pr_url_list
    for (let i = 0; i < commit_range.group_list.length; i++) {
      const group = commit_range.group_list[i];

      // use the updated pr_url_list to get the actual selected_url
      const selected_url = pr_url_list[i];

      invariant(group.base, "group.base must exist");

      const body = group.pr?.body || "";

      const update_body = StackSummaryTable.write({
        body,
        pr_url_list,
        selected_url,
      });

      if (update_body === body) {
        actions.debug(`Skipping body update for ${selected_url}`);
      } else {
        actions.debug(`Update body for ${selected_url}`);

        await github.pr_edit({
          branch: group.id,
          base: group.base,
          body: update_body,
        });
      }
    }

    // after all commits have been cherry-picked and amended
    // move the branch pointer to the newly created temporary branch
    // now we are in locally in sync with github and on the original branch
    await cli(`git branch -f ${branch_name} ${temp_branch_name}`);

    restore_git();

    actions.set((state) => {
      state.step = "post-rebase-status";
    });
  } catch (err) {
    actions.error("Unable to rebase.");

    if (err instanceof Error) {
      if (actions.isDebug()) {
        actions.error(err.message);
      }
    }

    handle_exit();
  }

  // cleanup git operations if cancelled during manual rebase
  function restore_git() {
    // signint handler MUST run synchronously
    // trying to use `await cli(...)` here will silently fail since
    // all children processes receive the SIGINT signal
    const spawn_options = { ignoreExitCode: true };

    // always put self back in original branch
    cli.sync(`git checkout ${branch_name}`, spawn_options);

    // ...and cleanup temporary branch
    cli.sync(`git branch -D ${temp_branch_name}`, spawn_options);

    if (commit_range) {
      // ...and cleanup pr group branches
      for (const group of commit_range.group_list) {
        cli.sync(`git branch -D ${group.id}`, spawn_options);
      }
    }
  }

  function handle_exit() {
    actions.output(
      <Ink.Text color={colors.yellow}>
        Restoring <Brackets>{branch_name}</Brackets>...
      </Ink.Text>
    );

    restore_git();

    actions.output(
      <Ink.Text color={colors.yellow}>
        Restored <Brackets>{branch_name}</Brackets>.
      </Ink.Text>
    );

    actions.exit(5);
  }
}

type CommitMetadataGroup = CommitMetadata.CommitRange["group_list"][number];
const get_group_url = (group: CommitMetadataGroup) => group.pr?.url || group.id;
