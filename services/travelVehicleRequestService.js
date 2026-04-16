const vehicleRequestModel = require('../models/vehicleRequestModel');

const DEFAULT_VEHICLE_LEARN_TO = 'สหกรณ์จังหวัดชัยภูมิ';

function shouldAutoManageVehicleRequest(travelItem) {
  return (
    travelItem &&
    travelItem.transport_type === 'official_vehicle' &&
    Number(travelItem.requires_vehicle_request) === 1
  );
}

function getPassengerCountFromTravel(travelItem) {
  const companionCount = Array.isArray(travelItem?.companions)
    ? travelItem.companions.length
    : Number(travelItem?.companion_count || 0);

  return Math.max(1, companionCount + 1);
}

function buildVehiclePayloadFromTravel(travelItem, actorName) {
  return {
    travel_request_id: travelItem.id,
    request_date: travelItem.request_date,
    learn_to: DEFAULT_VEHICLE_LEARN_TO,
    requester_member_id: travelItem.requester_member_id || null,
    requester_name: travelItem.requester_name,
    requester_position: travelItem.requester_position || null,
    destination_text: travelItem.destination_text,
    mission_text: travelItem.purpose_text,
    passenger_count: getPassengerCountFromTravel(travelItem),
    trip_start_at: travelItem.start_at,
    trip_end_at: travelItem.end_at,
    created_by: actorName,
    updated_by: actorName
  };
}

async function loadLinkedVehicleRequest(travelItem) {
  if (travelItem?.vehicleRequest?.id) {
    return vehicleRequestModel.getById(travelItem.vehicleRequest.id);
  }
  if (!travelItem?.id) {
    return null;
  }
  return vehicleRequestModel.getByTravelRequestId(travelItem.id);
}

async function syncDraftVehicleRequest(existingVehicleRequest, travelItem, actorName) {
  await vehicleRequestModel.update(existingVehicleRequest.id, {
    ...buildVehiclePayloadFromTravel(travelItem, actorName),
    vehicle_request_no: travelItem.request_no,
    status: existingVehicleRequest.status,
    submitted_at: existingVehicleRequest.submitted_at,
    approved_at: existingVehicleRequest.approved_at,
    rejected_at: existingVehicleRequest.rejected_at,
    cancelled_at: existingVehicleRequest.cancelled_at,
    completed_at: existingVehicleRequest.completed_at,
    approver_member_id: existingVehicleRequest.approver_member_id,
    approver_name: existingVehicleRequest.approver_name,
    approver_position: existingVehicleRequest.approver_position,
    approval_comment: existingVehicleRequest.approval_comment
  });
}

async function ensureVehicleRequestDraft(travelItem, user) {
  if (!shouldAutoManageVehicleRequest(travelItem)) {
    return { vehicleRequest: null, created: false, synced: false };
  }

  const actorName = user?.fullname || user?.username || 'system';
  let existingVehicleRequest = await loadLinkedVehicleRequest(travelItem);
  let created = false;
  let synced = false;

  if (!existingVehicleRequest) {
    const id = await vehicleRequestModel.create({
      ...buildVehiclePayloadFromTravel(travelItem, actorName),
      vehicle_request_no: travelItem.request_no,
      status: 'draft'
    });
    existingVehicleRequest = await vehicleRequestModel.getById(id);
    created = true;
  } else if (existingVehicleRequest.status === 'draft') {
    await syncDraftVehicleRequest(existingVehicleRequest, travelItem, actorName);
    existingVehicleRequest = await vehicleRequestModel.getById(existingVehicleRequest.id);
    synced = true;
  }

  const vehicleRequest = existingVehicleRequest
    ? await vehicleRequestModel.getDetailById(existingVehicleRequest.id)
    : null;

  return { vehicleRequest, created, synced };
}

async function ensureVehicleRequestSubmitted(travelItem, user) {
  const result = await ensureVehicleRequestDraft(travelItem, user);
  if (!result.vehicleRequest) {
    return { ...result, submitted: false };
  }

  if (result.vehicleRequest.status !== 'draft') {
    return { ...result, submitted: false };
  }

  await vehicleRequestModel.submit(result.vehicleRequest.id, user);
  return {
    ...result,
    submitted: true,
    vehicleRequest: await vehicleRequestModel.getDetailById(result.vehicleRequest.id)
  };
}

module.exports = {
  ensureVehicleRequestDraft,
  ensureVehicleRequestSubmitted,
  shouldAutoManageVehicleRequest
};
