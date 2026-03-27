<script lang="ts" setup>
import type { Notification } from '@layouts/types'

import { useTodos } from '@/stores/todos'
import { formatSystemDate } from '@core/utils/formatters'

type TodoCommentNotification = Notification & {
  meta: {
    todoId: number | string
    messageId: number | string
  }
}

const todosStore = useTodos()
todosStore.init()

const notificationIdFor = (todoId: number | string, messageId: number | string) =>
  `${todoId}:${messageId}`

const unreadMessages = computed(() =>
  Array.isArray(todosStore.items)
    ? todosStore.items.flatMap(todo =>
        Array.isArray(todo.messages)
          ? todo.messages
              .filter(message => !message?.isRead)
              .map(message => ({
                todoId: todo.id,
                todoTitle: todo.title,
                message,
              }))
          : [],
      )
    : [],
)

const notifications = computed<TodoCommentNotification[]>(() =>
  unreadMessages.value
    .slice()
    .sort(
      (a, b) =>
        new Date(b.message.createdAt).getTime() - new Date(a.message.createdAt).getTime(),
    )
    .map(({ todoId, todoTitle, message }) => ({
      id: Number(
        notificationIdFor(todoId, message.id)
          .split('')
          .reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 7),
      ),
      text: message.author?.name || 'Comment',
      title: todoTitle,
      subtitle: message.body,
      time: formatSystemDate(message.createdAt),
      isSeen: false,
      meta: {
        todoId,
        messageId: message.id,
      },
    })),
)

const updateReadState = (notificationIds: number[], isRead: boolean) => {
  const targets = notifications.value.filter(notification =>
    notificationIds.includes(notification.id),
  )

  targets.forEach(notification => {
    const todo = todosStore.byId(notification.meta.todoId)
    if (!todo || !Array.isArray(todo.messages)) return

    todosStore.updateTodo(notification.meta.todoId, {
      ...todo,
      messages: todo.messages.map(message =>
        String(message.id) === String(notification.meta.messageId)
          ? { ...message, isRead }
          : message,
      ),
    })
  })
}

const removeNotification = (notificationId: number) => {
  updateReadState([notificationId], true)
}

const markRead = (notificationIds: number[]) => {
  updateReadState(notificationIds, true)
}

const markUnRead = (notificationIds: number[]) => {
  updateReadState(notificationIds, false)
}

const handleNotificationClick = (notification: Notification) => {
  if (!notification.isSeen)
    markRead([notification.id])
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
