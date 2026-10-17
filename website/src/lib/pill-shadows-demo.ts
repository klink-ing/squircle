/** Change the shared consumer variable; the library tracks the pills itself. */
const preset = document.getElementById("shadow-preset") as HTMLSelectElement;
const value = document.getElementById("shadow-value") as HTMLInputElement;
const comparison = document.getElementById("shadow-comparison") as HTMLElement;
const message = document.getElementById("shadow-message") as HTMLElement;

const validShadow = (shadow: string) => shadow.trim() !== "" && CSS.supports("box-shadow", shadow);

// Modes reload the page so a worklet can be disabled. Carry the controls in
// each destination URL, including the last rendered value during invalid edits.
function updateModeLinks() {
  const url = new URL(location.href);
  url.searchParams.set("shadow", value.value);
  url.searchParams.set("preset", preset.value);
  if (validShadow(value.value)) url.searchParams.delete("applied-shadow");
  else url.searchParams.set("applied-shadow", comparison.style.getPropertyValue("--button-shadow"));
  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-mode]")) {
    url.searchParams.set("mode", link.dataset.mode!);
    link.href = url.href;
  }
}

function apply() {
  const shadow = value.value.trim();
  const valid = validShadow(shadow);
  value.setAttribute("aria-invalid", String(!valid));
  if (!valid) {
    message.textContent =
      "Enter a valid CSS box-shadow value. The last valid shadow stays visible.";
    updateModeLinks();
    return;
  }
  comparison.style.setProperty("--button-shadow", shadow);
  message.textContent = "Both buttons use shadow-(--button-shadow). Edit the value to update both.";
  updateModeLinks();
}

preset.addEventListener("change", () => {
  if (preset.value === "custom") {
    updateModeLinks();
    value.focus();
    return;
  }
  value.value = preset.value;
  apply();
});

const saved = new URLSearchParams(location.search);
const savedValue = saved.get("shadow");
if (savedValue !== null) {
  value.value = savedValue;
  const savedPreset = saved.get("preset");
  const matching = [...preset.options].find((option) => option.value === value.value.trim());
  preset.value = [...preset.options].some((option) => option.value === savedPreset)
    ? savedPreset!
    : (matching?.value ?? "custom");
  const applied = saved.get("applied-shadow");
  if (applied && validShadow(applied)) comparison.style.setProperty("--button-shadow", applied);
}
apply();
value.addEventListener("input", () => {
  const matching = [...preset.options].find((option) => option.value === value.value.trim());
  preset.value = matching?.value ?? "custom";
  apply();
});
