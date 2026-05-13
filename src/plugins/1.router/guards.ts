import type { RouteNamedMap, _RouterTyped } from 'unplugin-vue-router'
import { canNavigate } from '@layouts/plugins/casl'

const protectedPrefixes = [
  '/dashboards',
  '/apps',
  '/operations',
  '/finance',
  '/configuration',
  '/catalogues',
]

export const setupGuards = (router: _RouterTyped<RouteNamedMap & { [key: string]: any }>) => {
  // 👉 router.beforeEach
  // Docs: https://router.vuejs.org/guide/advanced/navigation-guards.html#global-before-guards
  router.beforeEach(to => {
    const isLoggedIn = !!(useCookie('userData').value && useCookie('accessToken').value)

    // Redirect logged-in users away from / to dashboards
    if (isLoggedIn && to.path === '/')
      return { name: 'dashboards-analytics' }

    // Only require auth for protected route prefixes
    const isProtected = protectedPrefixes.some(prefix => to.path.startsWith(prefix))

    if (!isProtected)
      return

    if (to.meta.unauthenticatedOnly) {
      if (isLoggedIn)
        return '/'
      else
        return undefined
    }

    if (!canNavigate(to) && to.matched.length) {
      /* eslint-disable indent */
      return isLoggedIn
        ? { name: 'not-authorized' }
        : {
            name: 'login',
            query: {
              ...to.query,
              to: to.fullPath !== '/' ? to.path : undefined,
            },
          }
      /* eslint-enable indent */
    }
  })
}
