import { createSiteContext, createDatabaseClient, errorResponse } from './_qoder/backend.mjs';
import { storage } from './_qoder/storage.mjs';
import { createApplication } from './router.mjs';

// This app owns its login: sessions are validated from its own table. The
// gateway still supplies the request context and stable error reporting.
const handle = createApplication({ db: createDatabaseClient(), storage });

Deno.serve(async (request) => {
  let context;
  try {
    context = createSiteContext(request, { forwardApplicationCredentials: true });
    return await handle(context);
  } catch (error) {
    return errorResponse(error, context?.requestId);
  }
});
