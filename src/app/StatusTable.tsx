import * as React from "react";

import * as Ink from "ink";

import { clamp } from "../core/clamp.js";
import { invariant } from "../core/invariant.js";

import { Store } from "./Store.js";

export function StatusTable() {
  const commit_range = Store.useState((state) => state.commit_range);

  invariant(commit_range, "commit_range must exist");

  const row_list = [];

  for (const group of commit_range.group_list) {
    const row = {
      icon: "",
      count: "",
      status: "",
      title: "",
      url: "",
    };

    if (group.id === commit_range.UNASSIGNED) {
      row.icon = "⭑";
      row.status = "NEW";
      row.title = "Unassigned";
      row.count = `0/${group.commits.length}`;
      row.url = "";
    } else {
      if (group.dirty) {
        row.icon = "!";
        row.status = "OUTDATED";
      } else {
        row.icon = "✔";
        row.status = "SYNCED";
      }

      if (group.pr) {
        row.title = group.pr.title;
        row.count = `${group.pr.commits.length}/${group.commits.length}`;
        row.url = group.pr.url;
      } else {
        row.title = group.id;
        row.count = `0/${group.commits.length}`;
      }
    }

    row_list.push(row);
  }

  if (!row_list.length) {
    return <Ink.Text dimColor>No data found.</Ink.Text>;
  }

  // walk data and discover max width for each column
  const sample_row = row_list[0];
  type ColKey = keyof typeof sample_row;
  const col_list = Object.keys(sample_row) as Array<ColKey>;
  const max_col_width = {} as { [key in ColKey]: number };

  for (const col of col_list) {
    max_col_width[col] = 0;
  }

  for (const row of row_list) {
    for (const col of col_list) {
      const value = row[col];
      max_col_width[col] = Math.max(value.length, max_col_width[col]);
    }
  }

  const { stdout } = Ink.useStdout();
  const available_width = stdout.columns;
  const columnGap = 2;
  const breathing_room = 10;

  const max_title_width = Math.min(max_col_width.title, MAX_TITLE_LENGTH);

  const remaining_space = clamp(
    available_width -
      // icon
      max_col_width.icon -
      // status
      max_col_width.status -
      // commits
      max_col_width.count -
      // url
      max_col_width.url -
      // gap * col count
      columnGap * col_list.length -
      // remove some extra space
      breathing_room,
    0,
    max_title_width
  );

  const title_width = remaining_space;

  return (
    <Ink.Box flexDirection="column" width={available_width}>
      <Ink.Box height={1} />

      {row_list.map((row) => {
        return (
          <Ink.Box
            key={row.url}
            // borderStyle="round"
            flexDirection="row"
            columnGap={columnGap}
            width={available_width}
          >
            <Ink.Box width={max_col_width.icon}>
              <Ink.Text>{row.icon}</Ink.Text>
            </Ink.Box>

            <Ink.Box width={max_col_width.status}>
              <Ink.Text>{row.status}</Ink.Text>
            </Ink.Box>

            <Ink.Box width={max_col_width.count}>
              <Ink.Text>{row.count}</Ink.Text>
            </Ink.Box>

            <Ink.Box width={title_width}>
              <Ink.Text wrap="truncate-end">{row.title}</Ink.Text>
            </Ink.Box>

            <Ink.Box width={max_col_width.url}>
              <Ink.Text>{row.url}</Ink.Text>
            </Ink.Box>
          </Ink.Box>
        );
      })}

      <Ink.Box height={1} />
    </Ink.Box>
  );
}

const MAX_TITLE_LENGTH = 50;
