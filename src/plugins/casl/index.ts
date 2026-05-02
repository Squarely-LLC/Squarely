import type { App } from 'vue'

import { abilitiesPlugin } from '@casl/vue'
import { ability, syncAbilityRules, type Rule } from './ability'

export default function (app: App) {
  const userAbilityRules = useCookie<Rule[]>('userAbilityRules')
  syncAbilityRules(userAbilityRules.value ?? [])

  app.use(abilitiesPlugin, ability, {
    useGlobalProperties: true,
  })
}
