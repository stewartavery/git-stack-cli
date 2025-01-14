import * as React from "react";

import * as Ink from "ink-cjs";
import { createStore, useStore } from "zustand";
import { immer } from "zustand/middleware/immer";

import { Exit } from "~/app/Exit";
import { LogTimestamp } from "~/app/LogTimestamp";
import { colors } from "~/core/colors";

import type { Instance as InkInstance } from "ink-cjs";
import type { Argv } from "~/command";
import type * as CommitMetadata from "~/core/CommitMetadata";
import type { PullRequest } from "~/core/github";

type Setter = (state: State) => void;

type CommitMap = Parameters<typeof CommitMetadata.range>[0];

type MutateOutputArgs = {
  node: React.ReactNode;
  id?: string;
  debug?: boolean;
  withoutTimestamp?: boolean;
};

export type State = {
  argv: null | Argv;
  ink: null | InkInstance;

  cwd: null | string;
  username: null | string;
  repo_path: null | string;
  repo_root: null | string;
  master_branch: string;
  head: null | string;
  merge_base: null | string;
  branch_name: null | string;
  commit_range: null | CommitMetadata.CommitRange;
  commit_map: null | CommitMap;

  step:
    | "github-api-error"
    | "loading"
    | "status"
    | "pre-local-merge-rebase"
    | "local-merge-rebase"
    | "pre-select-commit-ranges"
    | "select-commit-ranges"
    | "manual-rebase"
    | "manual-rebase-no-sync"
    | "post-rebase-status";

  output: Array<React.ReactNode>;
  pending_output: Record<string, Array<React.ReactNode>>;

  pr: { [branch: string]: PullRequest };

  actions: {
    exit(code: number, clear?: boolean): void;
    clear(): void;
    unmount(): void;
    newline(): void;
    json(value: object): void;
    error(message: string): void;
    output(node: React.ReactNode): void;
    debug(node: React.ReactNode, id?: string): void;

    isDebug(): boolean;

    reset_pr(): void;

    set(setter: Setter): void;
  };

  mutate: {
    output(state: State, args: MutateOutputArgs): void;
    pending_output(state: State, args: MutateOutputArgs): void;
    end_pending_output(state: State, id: string): void;
  };

  select: {
    debug(state: State): boolean;
  };
};

const BaseStore = createStore<State>()(
  immer((set, get) => ({
    argv: null,
    ink: null,

    cwd: null,
    username: null,
    repo_path: null,
    repo_root: null,
    master_branch: "master",
    head: null,
    merge_base: null,
    branch_name: null,
    commit_range: null,
    commit_map: null,

    step: "loading",

    output: [],
    pending_output: {},

    pr: {},

    actions: {
      exit(code, clear = true) {
        set((state) => {
          const node = <Exit clear={clear} code={code} />;
          state.mutate.output(state, { node });
        });
      },

      clear() {
        get().ink?.clear();
      },

      unmount() {
        get().ink?.unmount();
      },

      newline() {
        set((state) => {
          const node = "‎";
          state.mutate.output(state, { node });
        });
      },

      json(value) {
        set((state) => {
          const node = JSON.stringify(value, null, 2);
          state.mutate.output(state, { node });
        });
      },

      error(message) {
        set((state) => {
          const node = <Ink.Text color={colors.red}>{message}</Ink.Text>;
          state.mutate.output(state, { node });
        });
      },

      output(node) {
        set((state) => {
          state.mutate.output(state, { node });
        });
      },

      debug(node, id) {
        if (get().actions.isDebug()) {
          const debug = true;

          set((state) => {
            if (id) {
              state.mutate.pending_output(state, { id, node, debug });
            } else {
              state.mutate.output(state, { node, debug });
            }
          });
        }
      },

      isDebug() {
        const state = get();
        return state.select.debug(state);
      },

      reset_pr() {
        set((state) => {
          state.pr = {};
        });
      },

      set(setter) {
        set((state) => {
          setter(state);
        });
      },
    },

    mutate: {
      output(state, args) {
        const renderOutput = renderOutputArgs(args);
        state.output.push(renderOutput);
      },

      pending_output(state, args) {
        const { id } = args;

        if (!id) {
          return;
        }

        // set `withoutTimestamp` to skip <LogTimestamp> for all subsequent pending outputs
        // we only want to timestamp for the first part (when we initialize the [])
        // if we have many incremental outputs on the same line we do not want multiple timestamps
        //
        // await Promise.all([
        //   cli(`for i in $(seq 1 5); do echo $i; sleep 1; done`),
        //   cli(`for i in $(seq 5 1); do printf "$i "; sleep 1; done; echo`),
        // ]);
        //
        let withoutTimestamp = true;
        if (!state.pending_output[id]) {
          withoutTimestamp = false;
          state.pending_output[id] = [];
        }

        const renderOutput = renderOutputArgs({ ...args, withoutTimestamp });
        state.pending_output[id].push(renderOutput);
      },

      end_pending_output(state, id) {
        delete state.pending_output[id];
      },
    },

    select: {
      debug(state) {
        return state.argv?.verbose || false;
      },
    },
  }))
);

function renderOutputArgs(args: MutateOutputArgs) {
  let output = args.node;

  switch (typeof args.node) {
    case "boolean":
    case "number":
    case "string":
      output = <Ink.Text dimColor={args.debug}>{String(args.node)}</Ink.Text>;
  }

  if (args.debug) {
    return (
      <React.Fragment>
        {args.withoutTimestamp ? null : <LogTimestamp />}
        {output}
      </React.Fragment>
    );
  }

  return output;
}

function useState<R>(selector: (state: State) => R): R {
  return useStore(BaseStore, selector);
}

function useActions() {
  return useState((state) => state.actions);
}

const getState = BaseStore.getState;
const setState = BaseStore.setState;
const subscribe = BaseStore.subscribe;

export const Store = { useActions, useState, getState, setState, subscribe };
