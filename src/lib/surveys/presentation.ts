// Exact display alias for the documented local V5 installation. Catalog IDs,
// associations and stored names remain untouched.
export function institutionLabel(institution: { id: string; name: string }) {
  return institution.id === "c9875615-69f3-42d5-96fb-7e920ebadce8"
    && institution.name === "SYNTHETISCH / DEMO – V5 04fb49b1-4e3b-4fb0-807f-66837beae2f5"
    ? "Hochschule München" : institution.name;
}
