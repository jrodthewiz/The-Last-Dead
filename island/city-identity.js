const BUSINESSES=[
 {id:'press',name:'THE ORIN REGISTER',room:'EDITORIAL & DISPATCH',colour:0x7a7357,notice:'THE LAST EDITION',detail:'FERRY SERVICE SUSPENDED'},
 {id:'bank',name:'SAINT ORIN SAVINGS',room:'ACCOUNTS & RECORDS',colour:0x647969,notice:'COUNTER SERVICE',detail:'PLEASE JOIN THE QUEUE'},
 {id:'shipping',name:'NORTH STRAIT SHIPPING',room:'MANIFESTS & FREIGHT',colour:0x567b7a,notice:'EAST DOCKS',detail:'OUTBOUND CONSIGNMENTS'},
 {id:'radio',name:'COASTLINE RADIO',room:'STUDIO & TRANSMISSION',colour:0x875f4d,notice:'STUDIO FLOOR',detail:'PLEASE KEEP THE DOOR CLOSED'},
 {id:'studio',name:'ALDER & STONE',room:'ARCHITECTURE & SURVEY',colour:0x7d8270,notice:'THE ORIN CROSSING',detail:'PLANS & WORKING MODELS'},
 {id:'records',name:'WARD & VALE',room:'ASSURANCE & RECORDS',colour:0x766e83,notice:'PUBLIC RECORDS',detail:'PLEASE RETAIN YOUR RECEIPT'},
];
const RESIDENTS=[
 {id:'family',name:'MARINER COURT',room:'RESIDENTS & VISITORS',colour:0x829477,notice:'HOME BEFORE DARK',detail:'LEAVE A LIGHT FOR THE FERRY'},
 {id:'photographer',name:'ORIN HOUSE',room:'RESIDENTS & VISITORS',colour:0x9b826b,notice:'COASTAL PHOTOGRAPHS',detail:'THE ISLAND BEFORE THE SILENCE'},
 {id:'gardener',name:'ALDER TERRACE',room:'RESIDENTS & VISITORS',colour:0x708b7d,notice:'RESIDENTS GARDEN',detail:'SEEDS FOR NEXT SPRING'},
];
export function cityIdentity(b){
 if(b.district==='downtown')return BUSINESSES[b.seed%BUSINESSES.length];
 if(b.district==='civic')return b.id==='hospital-main'||b.id==='clinic'?{id:'medical',name:'NORTHPOINT HOSPITAL',room:'WARD & ADMISSIONS',colour:0x77978a,notice:'CARE & RECOVERY',detail:'EMERGENCY SUPPLIES AT RECEPTION'}:RESIDENTS[b.seed%RESIDENTS.length];
 if(b.district==='industrial')return b.seed%2?{id:'repair',name:'ORIN REPAIR WORKS',room:'TOOLS & REPAIRS',colour:0x8e7959,notice:'REPAIR BENCH',detail:'RETURN BORROWED TOOLS'}:{id:'freight',name:'STRAIT FREIGHT DEPOT',room:'RECEIVING & STORAGE',colour:0x667c72,notice:'FREIGHT RECEIVING',detail:'KEEP THE LOADING AISLE CLEAR'};
 return b.seed%2?{id:'cafe',name:'THE CROSSING CAFE',room:'COFFEE & PROVISIONS',colour:0x9b7f58,notice:'A TABLE BY THE WINDOW',detail:'COFFEE BEFORE THE CROSSING'}:{id:'office',name:'ORIN TRAVEL OFFICE',room:'TICKETS & TIMETABLES',colour:0x748877,notice:'THE LAST CROSSING',detail:'FERRY INFORMATION AT THE COUNTER'};
}
