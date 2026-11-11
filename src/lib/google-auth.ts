export function googleSignInOptions(origin: string) {
  const redirect = new URL('/folders', origin)
  if (!['http:', 'https:'].includes(redirect.protocol)) throw new Error('Invalid app origin')
  return { provider: 'google' as const, options: { redirectTo: redirect.href, queryParams: { prompt: 'select_account', include_granted_scopes: 'true' } } }
}
