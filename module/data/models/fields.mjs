/** Fresh field instances for each schema; notes and descriptions are plain text. */
export function textField() {
  return new foundry.data.fields.StringField({required: true, nullable: false, initial: ""});
}

export function numberField(options = {}) {
  return new foundry.data.fields.NumberField({required: true, nullable: false, initial: 0, ...options});
}

export function valueField() {
  return new foundry.data.fields.SchemaField({value: numberField()});
}
