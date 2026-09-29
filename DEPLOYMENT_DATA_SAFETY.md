# Deployment Data Safety

This package includes the populated SQLite database at `database/college_credit_bank.sqlite`.

## Important
- Do NOT run `DROP DATABASE`, `DROP TABLE`, database reset commands, or replace `college_credit_bank.sqlite` after deployment.
- The server seeds `seed.sql` only when the `admins` table is empty. An existing populated database is reused.
- The `/api/state` save logic is merge/UPSERT based and only deletes records whose IDs are explicitly sent in the delete lists.
- `college_credit_bank_before_test_data.sqlite` is included as a backup of the database before the added test data.

## Persistent hosting
SQLite data must live on persistent storage. On a hosting service that supports a persistent disk/volume, mount that disk and set:

`DATA_DIR=/path/to/persistent/data`

The server will then store `college_credit_bank.sqlite` in that directory. If no `DATA_DIR` is set, it uses the project's `database/` directory.

Before going live:
1. Upload/deploy this package.
2. Make sure the populated `database/college_credit_bank.sqlite` is present.
3. Enable a persistent disk/volume if the hosting provider has an ephemeral filesystem.
4. Set `DATA_DIR` to the mounted persistent directory.
5. Start with `npm start`.
6. Verify the original events, registrations, attendance, credits and inter-collegiate submission are visible.
7. Create one test record, restart the service, and verify it is still present before real use.

Never treat a redeploy as permission to reset or reseed the database.
