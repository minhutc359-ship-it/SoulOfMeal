export function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}
export const escapeAttr = escapeHtml;
export const elementColors = {
  fire: "#e7794d",
  water: "#57b9d5",
  wood: "#83bd6a",
  light: "#e8bf62",
  shadow: "#a38acd",
};
export function textLog(items = []) {
  return `<div class="log">${items
    .slice(0, 14)
    .map(
      (item) =>
        `<p>${escapeHtml(typeof item === "string" ? item : (item.text ?? item.type))}</p>`,
    )
    .join("")}</div>`;
}
