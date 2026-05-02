import { createMongoAbility } from '@casl/ability'

export type Actions = string

export type Subjects = string

export interface Rule { action: Actions; subject: Subjects }

export const ability = createMongoAbility<[Actions, Subjects]>()

export const syncAbilityRules = (rules?: Rule[] | null) => {
	ability.update(rules ?? [])
}
