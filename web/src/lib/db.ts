import { init, id, lookup } from "@instantdb/svelte";
import schema from "../../../shared/instant.schema";

export const db = init({
  appId: import.meta.env.VITE_INSTANT_APP_ID,
  schema,
});

export { id, lookup };
