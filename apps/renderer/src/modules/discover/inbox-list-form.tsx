import { ActionButton, Button } from "@follow/components/ui/button/index.js"
import { LoadingCircle } from "@follow/components/ui/loading/index.jsx"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@follow/components/ui/table/index.jsx"
import { FeedViewType, UserRole } from "@follow/constants"
import { env } from "@follow/shared/env"
import { useMutation } from "@tanstack/react-query"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useEventCallback } from "usehooks-ts"

import { useUserRole } from "~/atoms/user"
import { CopyButton } from "~/components/ui/code-highlighter"
import { useCurrentModal, useModalStack } from "~/components/ui/modal/stacked/hooks"
import { MAX_TRIAL_USER_INBOX_SUBSCRIPTION } from "~/constants/limit"
import { CustomSafeError } from "~/errors/CustomSafeError"
import { createErrorToaster } from "~/lib/error-parser"
import { useInboxList } from "~/queries/inboxes"
import { inboxActions, useInboxById } from "~/store/inbox"
import { subscriptionActions, useInboxSubscriptionCount } from "~/store/subscription"

import { useActivationModal } from "../activation"
import { InboxForm } from "./inbox-form"

const useCanCreateMoreInboxAndNotify = () => {
  const role = useUserRole()
  const currentInboxCount = useInboxSubscriptionCount()
  const presentActivationModal = useActivationModal()

  return useEventCallback(() => {
    if (role === UserRole.Trial) {
      const can = currentInboxCount < MAX_TRIAL_USER_INBOX_SUBSCRIPTION
      if (!can) {
        presentActivationModal()

        throw new CustomSafeError(
          `Trial user cannot create more inboxes, limit: ${MAX_TRIAL_USER_INBOX_SUBSCRIPTION}, current: ${currentInboxCount}`,
          true,
        )
      }
      return can
    } else {
      // const can = currentInboxCount < MAX_INBOX_COUNT
      // if (!can) {
      //   //  TODO
      // }
      // return can

      return true
    }
  })
}
export function DiscoverInboxList() {
  const { t } = useTranslation()
  const inboxes = useInboxList()

  const { present } = useModalStack()

  const preCheck = useCanCreateMoreInboxAndNotify()

  return (
    <>
      <div className="mb-4 flex items-center gap-2 text-sm text-zinc-500">
        <span>{t("discover.inbox.description")}</span>
        <a
          href="https://github.com/RSSNext/Follow/wiki/Inbox#webhooks"
          className="text-zinc-600 underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("discover.inbox.webhooks_docs")}
        </a>
      </div>
      <Table className="mb-8 w-[600px]">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-0 pr-6">{t("discover.inbox.handle")}</TableHead>
            <TableHead className="pl-0 pr-6">{t("discover.inbox.email")}</TableHead>
            <TableHead className="pl-0 pr-6">{t("discover.inbox.title")}</TableHead>
            <TableHead className="pl-0 pr-6">{t("discover.inbox.secret")}</TableHead>
            <TableHead className="center px-0">{t("discover.inbox.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inboxes.isLoading ? (
            <TableRow>
              <TableCell size="sm" colSpan={5}>
                <div className="center w-full">
                  <LoadingCircle size="large" />
                </div>
              </TableCell>
            </TableRow>
          ) : (
            inboxes.data?.map((inbox) => <Row id={inbox.id} key={inbox.id} />)
          )}
        </TableBody>
      </Table>
      <div className="center flex">
        {/* New Inbox */}
        <Button
          className="flex items-center gap-2"
          onClick={() =>
            preCheck() &&
            present({
              title: t("sidebar.feed_actions.new_inbox"),
              content: ({ dismiss }) => (
                <InboxForm
                  asWidget
                  onSuccess={() => {
                    inboxes.refetch()
                    dismiss()
                  }}
                />
              ),
            })
          }
        >
          <i className="i-mgc-add-cute-re" />
          {t("discover.inbox_create")}
        </Button>
      </div>
    </>
  )
}

const ConfirmDestroyModalContent = ({ id }: { id: string }) => {
  const { t } = useTranslation()
  const { dismiss } = useCurrentModal()

  const mutationDestroy = useMutation({
    mutationFn: async (id: string) => {
      return inboxActions.deleteInbox(id)
    },
    onSuccess: () => {
      subscriptionActions.fetchByView(FeedViewType.Articles)
      toast.success(t("discover.inbox_destroy_success"))
    },
    onMutate: () => {
      dismiss()
    },
    onError: createErrorToaster(t("discover.inbox_destroy_error")),
  })

  return (
    <div className="w-[540px]">
      <div className="mb-4">
        <i className="i-mingcute-warning-fill -mb-1 mr-1 size-5 text-red-500" />
        {t("discover.inbox_destroy_warning")}
      </div>
      <div className="flex justify-end">
        <Button className="bg-red-600" onClick={() => mutationDestroy.mutate(id)}>
          {t("words.confirm")}
        </Button>
      </div>
    </div>
  )
}

const Row = memo(({ id }: { id: string }) => {
  const { t } = useTranslation()
  const { present } = useModalStack()
  const inbox = useInboxById(id)
  if (!inbox) return null
  return (
    <TableRow key={inbox.id}>
      <TableCell size="sm">{inbox.id}</TableCell>
      <TableCell size="sm">
        <div className="group relative flex w-fit items-center gap-2">
          <span className="shrink-0">
            {inbox.id}
            {env.VITE_INBOXES_EMAIL}
          </span>
          <CopyButton
            value={`${inbox.id}${env.VITE_INBOXES_EMAIL}`}
            className="absolute -right-6 p-1 opacity-0 group-hover:opacity-100 [&_i]:size-3"
          />
        </div>
      </TableCell>
      <TableCell size="sm">{inbox.title}</TableCell>
      <TableCell size="sm">
        <div className="group relative flex w-fit items-center gap-2 font-mono">
          <span className="shrink-0">****</span>
          <CopyButton
            value={inbox.secret}
            className="absolute -right-6 p-1 opacity-0 group-hover:opacity-100 [&_i]:size-3"
          />
        </div>
      </TableCell>
      <TableCell size="sm" className="center">
        <ActionButton
          size="sm"
          tooltip={t("discover.inbox_destroy")}
          onClick={() =>
            present({
              title: t("discover.inbox_destroy_confirm"),
              content: () => <ConfirmDestroyModalContent id={inbox.id} />,
            })
          }
        >
          <i className="i-mgc-delete-2-cute-re" />
        </ActionButton>
        <ActionButton
          size="sm"
          onClick={() => {
            present({
              title: t("sidebar.feed_actions.edit_inbox"),
              content: ({ dismiss }) => <InboxForm asWidget id={inbox.id} onSuccess={dismiss} />,
            })
          }}
        >
          <i className="i-mgc-edit-cute-re" />
        </ActionButton>
      </TableCell>
    </TableRow>
  )
})
