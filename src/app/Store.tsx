import * as React from "react";

import * as Ink from "ink";
import { createStore, useStore } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { Argv } from "../command.js";
import type * as CommitMetadata from "../core/CommitMetadata.js";
import type { PullRequest } from "../core/github.js";
import type { Instance as InkInstance } from "ink";

type Setter = (state: State) => void;

type CommitMap = Parameters<typeof CommitMetadata.range>[0];

export type State = {
  argv: null | Argv;
  ink: null | InkInstance;

  cwd: null | string;
  head: null | string;
  merge_base: null | string;
  branch_name: null | string;
  commit_range: null | CommitMetadata.CommitRange;
  commit_map: null | CommitMap;

  step:
    | "loading"
    | "status"
    | "pre-select-commit-ranges"
    | "select-commit-ranges"
    | "manual-rebase";

  output: Array<React.ReactNode>;

  pr: { [branch: string]: PullRequest };

  actions: {
    clear(): void;
    exit(): void;
    newline(): void;
    output(node: React.ReactNode): void;

    reset_pr(): void;

    set(setter: Setter): void;
  };
};

const BaseStore = createStore<State>()(
  immer((set, get) => ({
    argv: null,
    ink: null,

    cwd: null,
    head: null,
    merge_base: null,
    branch_name: null,
    commit_range: null,
    select_commit_ranges: null,

    step: "loading",
    output: [],

    pr: {},

    actions: {
      clear() {
        get().ink?.clear();
      },

      exit() {
        get().ink?.unmount();
      },

      newline() {
        set((state) => {
          state.output.push(<Ink.Text>‎</Ink.Text>);
        });
      },

      output(node: React.ReactNode) {
        set((state) => {
          state.output.push(node);
        });
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
  }))
);

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
