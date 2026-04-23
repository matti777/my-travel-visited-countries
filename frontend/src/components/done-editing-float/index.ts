export interface DoneEditingFloatOptions {
  onDone: () => void;
}

/**
 * Floating hint + Done control for visit-list edit mode; mount on document.body.
 * Visibility and motion are driven by CSS classes on the root element.
 */
export function createDoneEditingFloat(options: DoneEditingFloatOptions): HTMLElement {
  const root = document.createElement("aside");
  root.id = "done-editing-float";
  root.className = "done-editing-float";
  root.setAttribute("role", "complementary");
  root.setAttribute("aria-label", "Editing visits");

  const inner = document.createElement("div");
  inner.className = "done-editing-float__inner";

  const text = document.createElement("p");
  text.className = "done-editing-float__text";
  text.textContent = "Click Done when finished with editing your visits.";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "done-editing-float__done edit-done-btn";
  btn.textContent = "Done";

  const { onDone } = options;
  btn.addEventListener("click", onDone);

  inner.appendChild(text);
  inner.appendChild(btn);
  root.appendChild(inner);

  return root;
}
