

## Uncomment "Pending With" Column in MRB Worklist

### Changes needed in `src/pages/Worklist.tsx`:

1. **Uncomment header column** (line 1000):
   - Change `{/* <th>Pending With</th> */}` to active `<th>Pending With</th>`

2. **Add data cell** after line 1084 (after the "Pending With column hidden per requirement" comment):
   - Insert `<td>` that displays `mrb.pendingWith` using `roleDisplayNames` for formatting
   - Show "-" when null

3. **Update colSpan** (line 1010):
   - Change from `colSpan={22}` to `colSpan={19}` (accounting for the now-visible Pending With column)

### Result
The "Pending With" column will display in the MRB worklist table showing which department/role the MRB is currently waiting on.

