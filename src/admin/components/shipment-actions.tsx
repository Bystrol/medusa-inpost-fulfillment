import {
  ArrowDownTray,
  ArrowPath,
  ArrowUpRightOnBox,
  EllipsisHorizontal,
  Eye,
  SquareTwoStack,
  Trash,
} from "@medusajs/icons";
import { DropdownMenu, IconButton, Tooltip, toast } from "@medusajs/ui";
import {
  InPostAdminShipment,
  canCancelInPostShipmentViaApi,
} from "../../lib/admin-shipments";
import { InPostLabelFormat } from "../../lib/types";
import {
  cancelInPostShipment,
  downloadInPostLabel,
  getTrackingUrl,
  refreshInPostShipmentData,
} from "../lib/inpost-api";

type ShipmentActionsProps = {
  shipment: InPostAdminShipment;
  onRefresh?: (shipment: InPostAdminShipment) => void;
  onViewRaw?: (shipment: InPostAdminShipment) => void;
};

const CANCEL_DISABLED_TOOLTIP =
  "ShipX allows API cancellation only before confirmation. Cancel this shipment manually in InPost Manager or WebTrucker.";

export function ShipmentActions({
  shipment,
  onRefresh,
  onViewRaw,
}: ShipmentActionsProps) {
  const canCancel = canCancelInPostShipmentViaApi(shipment.status);

  const handleRefresh = async () => {
    try {
      const refreshed = await refreshInPostShipmentData(shipment.id);
      onRefresh?.(refreshed);
      toast.success("InPost shipment data refreshed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const handleDownload = async (format: InPostLabelFormat) => {
    try {
      await downloadInPostLabel(shipment, format);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const handleCopyTrackingNumber = async () => {
    if (!shipment.tracking_number) {
      return;
    }

    await navigator.clipboard.writeText(shipment.tracking_number);
    toast.success("Tracking number copied");
  };

  const handleCancel = async () => {
    if (
      !window.confirm(
        `Cancel InPost shipment ${shipment.shipment_id}? This action is sent to ShipX.`
      )
    ) {
      return;
    }

    try {
      const canceled = await cancelInPostShipment(shipment.id);
      onRefresh?.(canceled);
      toast.success("InPost shipment cancelled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <IconButton size="small" variant="transparent">
          <EllipsisHorizontal />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item onClick={handleRefresh}>
          <ArrowPath />
          Refresh from InPost
        </DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => handleDownload("pdf")}>
          <ArrowDownTray />
          Download PDF
        </DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => handleDownload("zpl")}>
          <ArrowDownTray />
          Download ZPL
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          disabled={!shipment.tracking_number}
          onClick={() => {
            if (shipment.tracking_number) {
              window.open(getTrackingUrl(shipment.tracking_number), "_blank");
            }
          }}
        >
          <ArrowUpRightOnBox />
          Open tracking
        </DropdownMenu.Item>
        <DropdownMenu.Item
          disabled={!shipment.tracking_number}
          onClick={handleCopyTrackingNumber}
        >
          <SquareTwoStack />
          Copy tracking number
        </DropdownMenu.Item>
        {onViewRaw ? (
          <DropdownMenu.Item onClick={() => onViewRaw(shipment)}>
            <Eye />
            View raw response
          </DropdownMenu.Item>
        ) : null}
        <DropdownMenu.Separator />
        {canCancel ? (
          <DropdownMenu.Item onClick={handleCancel}>
            <Trash />
            Cancel shipment
          </DropdownMenu.Item>
        ) : (
          <Tooltip content={CANCEL_DISABLED_TOOLTIP} side="left">
            <DropdownMenu.Item
              aria-disabled="true"
              className="text-ui-fg-disabled cursor-not-allowed"
              onSelect={(event) => event.preventDefault()}
            >
              <Trash />
              Cancel shipment
            </DropdownMenu.Item>
          </Tooltip>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
