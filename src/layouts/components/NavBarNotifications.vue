<script lang="ts" setup>
import type { Notification } from '@layouts/types'

import {
  type SystemNotificationTarget,
  useSystemNotificationsStore,
} from '@/stores/systemNotifications'
import { getSignedInIdentity } from '@/utils/currentAccount'
import { formatSystemDate } from '@core/utils/formatters'
import { useRouter } from 'vue-router'

type SystemBellNotification = Notification & {
  meta: {
    systemNotificationId: number
  }
}

const router = useRouter()
const systemNotificationsStore = useSystemNotificationsStore()
systemNotificationsStore.init()

const currentIdentityIds = computed(() => {
  const identity = getSignedInIdentity()
  return new Set(
    [identity.employeeId, identity.personId, identity.id]
      .filter(value => value !== undefined && value !== null && value !== '')
      .map(value => String(value)),
  )
})

const notifications = computed<SystemBellNotification[]>(() =>
  systemNotificationsStore.items
    .filter(notification =>
      currentIdentityIds.value.has(String(notification.recipientEmployeeId)),
    )
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map(notification => ({
      id: notification.id,
      icon: 'tabler-bell',
      title: notification.title,
      subtitle: notification.body,
      time: formatSystemDate(notification.createdAt),
      isSeen: Boolean(notification.readAt),
      meta: {
        systemNotificationId: notification.id,
      },
    })),
)

const updateReadState = (notificationIds: number[], isRead: boolean) => {
  if (isRead)
    systemNotificationsStore.markRead(notificationIds)
  else
    systemNotificationsStore.markUnread(notificationIds)
}

const removeNotification = (notificationId: number) => {
  systemNotificationsStore.remove(notificationId)
}

const markRead = (notificationIds: number[]) => {
  updateReadState(notificationIds, true)
}

const markUnRead = (notificationIds: number[]) => {
  updateReadState(notificationIds, false)
}

const routeForTarget = (target: SystemNotificationTarget | null | undefined) => {
  if (!target) return null
  if (target.routeName) {
    const params =
      target.params ??
      (target.entityId !== undefined && target.entityId !== null
        ? { id: target.entityId }
        : undefined)

    return {
      name: target.routeName,
      params,
      query: target.query,
    } as any
  }
  if (target.path) return { path: target.path, query: target.query } as any

  return null
}

const handleNotificationClick = (notification: Notification) => {
  const systemNotification = systemNotificationsStore.items.find(
    item => Number(item.id) === Number(notification.id),
  )

  if (!notification.isSeen)
    markRead([notification.id])

  const route = routeForTarget(systemNotification?.target)
  if (route)
    void router.push(route)
}
</script>

<template>
  <Notifications
    :notifications="notifications"
    @remove="removeNotification"
    @read="markRead"
    @unread="markUnRead"
    @click:notification="handleNotificationClick"
  />
</template>
