/** Shared creation dice; results stay in the preparation UI, never automatic public chat. */
export async function rollCreationD20(){return (await new foundry.dice.Roll("1d20").evaluate()).total;}
