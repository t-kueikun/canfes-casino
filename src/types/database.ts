// The server routes use validated service-client queries and cast their
// response rows at the API boundary. Keep the generated Supabase shape loose
// until the dedicated project schema is generated for the new tables.
export type Database = any;
