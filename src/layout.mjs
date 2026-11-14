// Presentation-only geometry. The engine always stores 4 rows × N columns.
// Tall screens show the 6-column board transposed (6 rows × 4 columns): the
// same cells and the same neighbors, drawn with rows and columns swapped.
export function boardLayout(config,tall=false) {
  const transposed=Boolean(tall)&&config.columns>config.rows;
  const rows=transposed?config.columns:config.rows,columns=transposed?config.rows:config.columns;
  const order=Array.from({length:rows*columns},(_,slot)=>{
    const row=Math.floor(slot/columns),column=slot%columns;
    return transposed?column*config.columns+row:row*config.columns+column;
  });
  const slotOf=new Map(order.map((index,slot)=>[index,slot]));
  const place=index=>({row:Math.floor(slotOf.get(index)/columns)+1,column:slotOf.get(index)%columns+1});
  return {transposed,rows,columns,order,slotOf,place,label:index=>{const p=place(index);return `linha ${p.row}, coluna ${p.column}`;}};
}
// Neighbor of a cell in a screen direction, or null at the edge (keyboard navigation).
export function neighborSlot(layout,slot,dx,dy) {
  const row=Math.floor(slot/layout.columns)+dy,column=slot%layout.columns+dx;
  return row<0||row>=layout.rows||column<0||column>=layout.columns?null:row*layout.columns+column;
}
