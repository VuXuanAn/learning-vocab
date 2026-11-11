/** undefined keeps Base UI's normal/nested portal; null explicitly prevents mounting. */
export function selectPortalContainer<T>(explicit:T|undefined,fullscreen:T|null):T|undefined{
 return explicit===undefined?fullscreen??undefined:explicit
}
