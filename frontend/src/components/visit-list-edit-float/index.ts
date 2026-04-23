export type VisitListEditFloatMode = "idle" | "editing";

export interface VisitListEditFloatOptions {
  mode: VisitListEditFloatMode;
  onPrimary: () => void;
}

export const VISIT_LIST_EDIT_FLOAT_ID = "visit-list-edit-float";

const TEXT_BY_MODE: Record<VisitListEditFloatMode, string> = {
  idle: "Press Edit to edit the list of your visits.",
  editing: "Click Done when finished with editing your visits.",
};

const LABEL_BY_MODE: Record<VisitListEditFloatMode, string> = {
  idle: "Edit",
  editing: "Done",
};

function setRootModeAttributes(root: HTMLElement, mode: VisitListEditFloatMode): void {
  root.classList.remove("visit-list-edit-float--idle", "visit-list-edit-float--editing");
  root.classList.add(mode === "idle" ? "visit-list-edit-float--idle" : "visit-list-edit-float--editing");
  root.setAttribute(
    "aria-label",
    mode === "idle" ? "Press Edit to edit your visits" : "Editing visits",
  );
}

function buildInner(inner: HTMLElement, options: VisitListEditFloatOptions): void {
  const { mode, onPrimary } = options;
  inner.replaceChildren();

  const text = document.createElement("p");
  text.className = "visit-list-edit-float__text";
  text.textContent = TEXT_BY_MODE[mode];

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "visit-list-edit-float__action edit-done-btn";
  btn.textContent = LABEL_BY_MODE[mode];
  btn.addEventListener("click", onPrimary);

  inner.appendChild(text);
  inner.appendChild(btn);
}

/**
 * Floating hint + Edit/Done for visit-list tabs; mount on document.body.
 * Visibility uses `visit-list-edit-float--visible` on the root.
 */
export function createVisitListEditFloat(options: VisitListEditFloatOptions): HTMLElement {
  const root = document.createElement("aside");
  root.id = VISIT_LIST_EDIT_FLOAT_ID;
  root.className = "visit-list-edit-float";
  root.setAttribute("role", "complementary");
  setRootModeAttributes(root, options.mode);

  const inner = document.createElement("div");
  inner.className = "visit-list-edit-float__inner";
  buildInner(inner, options);
  root.appendChild(inner);

  return root;
}

/** Replace copy, button, and handlers when toggling idle vs editing without remounting. */
export function updateVisitListEditFloat(root: HTMLElement, options: VisitListEditFloatOptions): void {
  setRootModeAttributes(root, options.mode);
  const inner = root.querySelector(".visit-list-edit-float__inner");
  if (!(inner instanceof HTMLElement)) return;
  buildInner(inner, options);
}
