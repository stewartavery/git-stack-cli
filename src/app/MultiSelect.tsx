import * as React from "react";

import * as Ink from "ink";

import { clamp } from "../core/clamp.js";
import { wrap_index } from "../core/wrap_index.js";

type Item<T> = {
  label: string;
  value: T;
  selected?: ItemRowProps["selected"];
  disabled?: ItemRowProps["disabled"];
};

type SelectArgs<T> = {
  item: T;
  selected: boolean;
  state: Array<T>;
};

type Props<T> = {
  items: Array<Item<T>>;
  onSelect(args: SelectArgs<T>): void;
};

export function MultiSelect<T>(props: Props<T>) {
  const [selected_set, select] = React.useReducer(
    (state: Set<number>, value: number) => {
      const next = new Set(state);

      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }

      return next;
    },
    new Set<number>(),
    (set) => {
      props.items.forEach((item, i) => {
        if (item.selected) {
          set.add(i);
        }
      });

      return set;
    }
  );

  // clamp index to keep in item range
  const [index, set_index] = React.useReducer(
    (_: unknown, value: number) => {
      return clamp(value, 0, props.items.length - 1);
    },
    0,
    function find_initial_index() {
      let firstEnabled;

      for (let i = props.items.length - 1; i >= 0; i--) {
        const item = props.items[i];
        if (!item.disabled && firstEnabled === undefined) {
          firstEnabled = i;
        }

        if (item.selected && !item.disabled) {
          return i;
        }
      }

      if (typeof firstEnabled === "number") {
        return firstEnabled;
      }

      return 0;
    }
  );

  const selectRef = React.useRef(false);

  React.useEffect(() => {
    if (!selectRef.current) {
      // console.debug("[MultiSelect]", "skip onSelect before selectRef");
      return;
    }

    const item = props.items[index].value;
    const selected_list = Array.from(selected_set);
    const selected = selected_set.has(index);
    const state = selected_list.map((index) => props.items[index].value);

    // console.debug({ item, selected, state });
    props.onSelect({ item, selected, state });
  }, [selected_set]);

  Ink.useInput((_input, key) => {
    if (key.return) {
      selectRef.current = true;
      const item = props.items[index];
      if (!item.disabled) {
        return select(index);
      }
    }

    if (key.upArrow) {
      let check = index;
      for (let i = 0; i < props.items.length; i++) {
        check = wrap_index(check - 1, props.items);
        // console.debug("up", { check, i, index });

        const item = props.items[check];
        if (!item.disabled) {
          return set_index(check);
        }
      }
    }

    if (key.downArrow) {
      let check = index;
      for (let i = 0; i < props.items.length; i++) {
        check = wrap_index(check + 1, props.items);
        // console.debug("down", { check, i, index });

        const item = props.items[check];
        if (!item.disabled) {
          return set_index(check);
        }
      }
    }
  });

  return (
    <Ink.Box flexDirection="column">
      {props.items.map((item, i) => {
        const active = i === index;
        const selected = selected_set.has(i);
        const disabled = item.disabled || false;

        return (
          <ItemRow
            key={item.label}
            label={item.label}
            active={active}
            selected={selected}
            disabled={disabled}
          />
        );
      })}
    </Ink.Box>
  );
}

type ItemRowProps = {
  label: string;
  active: boolean;
  selected: boolean;
  disabled: boolean;
};

function ItemRow(props: ItemRowProps) {
  let color;
  let bold;
  let underline;
  let dimColor;

  if (props.active) {
    color = "#38bdf8";
    underline = true;
  }

  if (props.selected) {
    // color = "";
    bold = true;
  }

  if (props.disabled) {
    color = "";
    bold = false;
    underline = false;
    dimColor = true;
  }

  return (
    <Ink.Box flexDirection="row" gap={1}>
      <Radio selected={props.selected} disabled={props.disabled} />

      <Ink.Box>
        <Ink.Text
          bold={bold}
          underline={underline}
          color={color}
          dimColor={dimColor}
          wrap="truncate-end"
        >
          {props.label}
        </Ink.Text>
      </Ink.Box>
    </Ink.Box>
  );
}

type RadioProps = {
  selected: ItemRowProps["selected"];
  disabled: ItemRowProps["disabled"];
};

function Radio(props: RadioProps) {
  let display;
  let color;
  let dimColor;

  if (props.selected) {
    // display = "✓";
    display = "◉";
    color = "green";
  } else {
    // display = " ";
    display = "◯";
    color = "";
  }

  if (props.disabled) {
    color = "gray";
    dimColor = true;
  }

  return (
    <Ink.Text bold={props.selected} color={color} dimColor={dimColor}>
      {display}
    </Ink.Text>
  );
}
