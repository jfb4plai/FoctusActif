import { runTaskStoreContractTests } from './taskStore.contract.js'
import { createLocalStore } from './localStore.js'

let counter = 0
runTaskStoreContractTests(() => createLocalStore(`focusactif-test-${counter++}`))
