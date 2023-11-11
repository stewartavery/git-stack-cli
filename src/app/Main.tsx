import * as React from "react";

import * as Ink from "ink";

import { SelectCommitRanges } from "./SelectCommitRanges.js";
import { Status } from "./Status.js";
import { Store } from "./Store.js";

export function Main() {
  const step = Store.useState((state) => state.step);

  if (step === "loading") {
    return null;
  }

  if (step === "status") {
    return <Status />;
  }

  if (step === "select-commit-ranges") {
    return <SelectCommitRanges />;
  }

  return <Ink.Text>Main</Ink.Text>;
}