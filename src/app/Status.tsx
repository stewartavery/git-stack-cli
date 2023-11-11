import * as React from "react";

import * as Ink from "ink";

import { invariant } from "../core/invariant.js";

import { Await } from "./Await.js";
import { Exit } from "./Exit.js";
import { StatusTable } from "./StatusTable.js";
import { Store } from "./Store.js";

import type { Argv } from "../command.js";

export function Status() {
  const argv = Store.useState((state) => state.argv);
  invariant(argv, "argv must exist");

  return <Await fallback={null} function={() => run({ argv })} />;
}

type Args = {
  argv: Argv;
};

async function run(args: Args) {
  const actions = Store.getState().actions;
  const commit_range = Store.getState().commit_range;

  invariant(commit_range, "commit_range must exist");

  actions.output(<StatusTable />);

  let needs_update = false;

  for (const group of commit_range.group_list) {
    if (group.dirty) {
      needs_update = true;
      break;
    }
  }

  if (args.argv.check) {
    actions.output(<Exit clear code={0} />);
    return;
  }

  if (!args.argv.force && !needs_update) {
    actions.newline();
    actions.output(<Ink.Text>✅ Everything up to date.</Ink.Text>);
    actions.output(
      <Ink.Text color="gray">
        <Ink.Text>Run with</Ink.Text>
        <Ink.Text bold color="yellow">
          {` --force `}
        </Ink.Text>
        <Ink.Text>to force update all pull requests.</Ink.Text>
      </Ink.Text>
    );
    actions.output(<Exit clear code={0} />);
  }

  Store.setState((state) => {
    state.step = "pre-select-commit-ranges";
  });
}
