/** Change the shared consumer variable; the library tracks the pills itself. */
const preset = document.getElementById("shadow-preset") as HTMLSelectElement;
const value = document.getElementById("shadow-value") as HTMLInputElement;
const comparison = document.getElementById("shadow-comparison") as HTMLElement;
const message = document.getElementById("shadow-message") as HTMLElement;

function apply() {
  const shadow = value.value.trim();
  const valid = shadow !== "" && CSS.supports("box-shadow", shadow);
  value.setAttribute("aria-invalid", String(!valid));
  if (!valid) {
    message.textContent =
      "Enter a valid CSS box-shadow value. The last valid shadow stays visible.";
    return;
  }
  comparison.style.setProperty("--button-shadow", shadow);
  message.textContent = "Both buttons use shadow-(--button-shadow). Edit the value to update both.";
}

preset.addEventListener("change", () => {
  if (preset.value === "custom") {
    value.focus();
    return;
  }
  value.value = preset.value;
  apply();
});
value.addEventListener("input", () => {
  const matching = [...preset.options].find((option) => option.value === value.value.trim());
  preset.value = matching?.value ?? "custom";
  apply();
});
