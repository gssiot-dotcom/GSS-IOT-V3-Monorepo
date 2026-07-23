import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import type { ReactNode } from "react";

export function ModalFormFooter({
  cancelLabel,
  onCancel,
  onSubmit,
  submitLabel,
  submitLoading = false,
  submitDisabled = false,
  submitColor,
}: {
  cancelLabel: string;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitLoading?: boolean;
  submitDisabled?: boolean;
  submitColor?: string;
}) {
  return (
    <Group className="gss-modal-form-footer" justify="space-between" mt="lg">
      <Button disabled={submitLoading} onClick={onCancel} variant="subtle">
        {cancelLabel}
      </Button>
      <Button
        color={submitColor}
        disabled={submitDisabled}
        loading={submitLoading}
        onClick={onSubmit}
      >
        {submitLabel}
      </Button>
    </Group>
  );
}

export function ConfirmActionModal({
  cancelLabel,
  confirmLabel,
  description,
  entityName,
  loading = false,
  onClose,
  onConfirm,
  opened,
  title,
}: {
  cancelLabel: string;
  confirmLabel: string;
  description: ReactNode;
  entityName: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  opened: boolean;
  title: string;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Stack gap="md">
        <Alert color="red" icon={<IconAlertTriangle size={18} />}>
          <Text fw={650} size="sm">
            {entityName}
          </Text>
          <Text size="sm">{description}</Text>
        </Alert>
        <ModalFormFooter
          cancelLabel={cancelLabel}
          onCancel={onClose}
          onSubmit={onConfirm}
          submitColor="red"
          submitLabel={confirmLabel}
          submitLoading={loading}
        />
      </Stack>
    </Modal>
  );
}
