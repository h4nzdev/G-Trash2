[plugin:vite:oxc] Transform failed with 2 errors:

[PARSE_ERROR] Error: Identifier `handleResolve` has already been declared
    ╭─[ src/pages/ReportsManagement.jsx:45:9 ]
    │
 45 │   const handleResolve = async (report) => {
    │         ──────┬──────  
    │               ╰──────── `handleResolve` has already been declared here
    │ 
 71 │   const handleResolve = (report) => {
    │         ──────┬──────  
    │               ╰──────── It can not be redeclared here
────╯

[PARSE_ERROR] Error: Identifier `handleAssign` has already been declared
    ╭─[ src/pages/ReportsManagement.jsx:53:9 ]
    │
 53 │   const handleAssign = async (report) => {
    │         ──────┬─────  
    │               ╰─────── `handleAssign` has already been declared here
    │ 
 76 │   const handleAssign = (report) => {
    │         ──────┬─────  
    │               ╰─────── It can not be redeclared here
────╯
C:/Users/hanzc/Documents/Get-Trash/Officials/src/pages/ReportsManagement.jsx