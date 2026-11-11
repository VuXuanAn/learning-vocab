// A newly due card must never interrupt the card already being studied.
export function selectReviewItem<T extends {card:{id:string}}>(queue:T[], activeId:string|undefined, due:(item:T)=>boolean):T|undefined {
 return queue.find(item=>item.card.id===activeId)??queue.find(due)
}
