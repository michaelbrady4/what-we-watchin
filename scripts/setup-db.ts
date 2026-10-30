import { closeDb, ensureSchema } from "../lib/db";

ensureSchema()
  .then(async () => {
    console.log("Tables are ready.");
    await closeDb();
  })
  .catch(async (error) => {
    console.error(error);
    await closeDb();
    process.exit(1);
  });
