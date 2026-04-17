const officialTravelRequestModel = require('../models/officialTravelRequestModel');
const vehicleRequestModel = require('../models/vehicleRequestModel');
const vehicleMasterModel = require('../models/vehicleMasterModel');
const driverMasterModel = require('../models/driverMasterModel');
const vehicleAssignmentModel = require('../models/vehicleAssignmentModel');
const workflowNotificationService = require('../services/workflowNotificationService');
const gitgumTravelSyncService = require('../services/gitgumTravelSyncService');
const { ensureVehicleRequestApproved } = require('../services/travelVehicleRequestService');

function isMissingWorkflowTable(error) {
  return error && error.code === 'ER_NO_SUCH_TABLE';
}

async function loadPendingCounts() {
  const [travelItems, vehicleItems] = await Promise.all([
    officialTravelRequestModel.listPendingApproval(),
    vehicleRequestModel.listPendingApproval()
  ]);

  return {
    travelItems,
    vehicleItems
  };
}

function buildAssignmentSelection(item, body = {}) {
  return {
    vehicle_id: body.vehicle_id || item?.vehicle_id || '',
    driver_id: body.driver_id || item?.driver_id || '',
    assignment_note: body.assignment_note || ''
  };
}

function getActorName(user) {
  return user?.fullname || user?.username || 'system';
}

async function renderVehicleDetail(res, item, overrides = {}) {
  const vehicles = overrides.vehicles || await vehicleMasterModel.listActive();
  const drivers = overrides.drivers || await driverMasterModel.listActive();

  res.render('vehicle-approval/request-detail', {
    title: 'พิจารณาคำขอใช้รถราชการ',
    item,
    vehicles,
    drivers,
    error: overrides.error || null,
    assignmentSelection: overrides.assignmentSelection || buildAssignmentSelection(item)
  });
}

exports.dashboard = async (req, res) => {
  try {
    const { travelItems, vehicleItems } = await loadPendingCounts();
    res.render('vehicle-approval/dashboard', {
      title: 'แดชบอร์ดอนุมัติคำขอ',
      travelItems,
      vehicleItems,
      warning: null
    });
  } catch (error) {
    if (isMissingWorkflowTable(error)) {
      return res.render('vehicle-approval/dashboard', {
        title: 'แดชบอร์ดอนุมัติคำขอ',
        travelItems: [],
        vehicleItems: [],
        warning: 'ยังไม่พบตาราง workflow สำหรับคิวอนุมัติในฐานข้อมูล กรุณารัน migration ก่อนจึงจะใช้งานหน้านี้ได้เต็มรูปแบบ'
      });
    }
    console.error('Error loading approval dashboard:', error);
    res.status(500).send('ไม่สามารถโหลดแดชบอร์ดอนุมัติได้');
  }
};

exports.pending = async (req, res) => {
  try {
    const { travelItems, vehicleItems } = await loadPendingCounts();
    res.render('vehicle-approval/pending', {
      title: 'คิวอนุมัติคำขอ',
      travelItems,
      vehicleItems,
      warning: null
    });
  } catch (error) {
    if (isMissingWorkflowTable(error)) {
      return res.render('vehicle-approval/pending', {
        title: 'คิวอนุมัติคำขอ',
        travelItems: [],
        vehicleItems: [],
        warning: 'ยังไม่พบตาราง workflow สำหรับคิวอนุมัติในฐานข้อมูล กรุณารัน migration ก่อนจึงจะใช้งานหน้านี้ได้เต็มรูปแบบ'
      });
    }
    console.error('Error loading approval queue:', error);
    res.status(500).send('ไม่สามารถโหลดคิวอนุมัติได้');
  }
};

exports.travelDetail = async (req, res) => {
  try {
    const item = await officialTravelRequestModel.getDetailById(req.params.id);
    if (!item) {
      return res.status(404).send('ไม่พบคำขอไปราชการ');
    }

    let vehicles = [];
    let drivers = [];
    if (item.vehicleRequest) {
      [vehicles, drivers] = await Promise.all([
        vehicleMasterModel.listActive(),
        driverMasterModel.listActive()
      ]);
    }

    res.render('vehicle-approval/travel-detail', {
      title: 'พิจารณาคำขอไปราชการ',
      item,
      vehicles,
      drivers,
      assignmentSelection: buildAssignmentSelection(item)
    });
  } catch (error) {
    console.error('Error loading travel approval detail:', error);
    res.status(500).send('ไม่สามารถโหลดคำขอไปราชการได้');
  }
};

exports.approveTravel = async (req, res) => {
  try {
    await officialTravelRequestModel.approve(req.params.id, req.session?.user, req.body.approval_comment);
    const item = await officialTravelRequestModel.getDetailById(req.params.id);
    if (!item) {
      return res.status(404).send('ไม่พบคำขอไปราชการ');
    }

    await gitgumTravelSyncService.syncApprovedTravel(item);
    await workflowNotificationService.notifyTravelDecision(
      item,
      'อนุมัติ',
      req.session?.user?.fullname || req.session?.user?.username || 'system'
    );

    if (item.vehicleRequest) {
      const updatedVehicleRequest = await ensureVehicleRequestApproved(item, req.session?.user);
      let vehicleReq = updatedVehicleRequest.vehicleRequest;

      try {
        const selectedVehicleId = req.body.vehicle_id;
        const selectedDriverId = req.body.driver_id;
        const assignmentNote = req.body.assignment_note || null;

        if (selectedVehicleId && selectedDriverId) {
          const [vehicles, drivers] = await Promise.all([
            vehicleMasterModel.listActive(),
            driverMasterModel.listActive()
          ]);
          const selectedVehicle = vehicles.find((vehicle) => Number(vehicle.id) === Number(selectedVehicleId));
          const selectedDriver = drivers.find((driver) => Number(driver.id) === Number(selectedDriverId));

          if (!selectedVehicle || !selectedDriver) {
            throw new Error('กรุณาเลือกรถและคนขับให้ถูกต้อง');
          }

          const overlapping = await vehicleAssignmentModel.findOverlappingAssignment(
            selectedVehicle.id,
            vehicleReq.trip_start_at,
            vehicleReq.trip_end_at,
            vehicleReq.id
          );

          if (overlapping) {
            throw new Error(`รถ ${selectedVehicle.plate_no} ถูกมอบหมายทับช่วงเวลาให้คำขอ ${overlapping.vehicle_request_no} แล้ว`);
          }

          await vehicleAssignmentModel.upsertAssignment({
            vehicle_request_id: vehicleReq.id,
            vehicle_id: selectedVehicle.id,
            driver_id: selectedDriver.id,
            assigned_by_member_id: req.session?.user?.id || null,
            assignment_note: assignmentNote,
            plate_no_snapshot: selectedVehicle.plate_no,
            driver_name_snapshot: selectedDriver.driver_name,
            updated_by: getActorName(req.session?.user)
          });

          const updatedItem = await officialTravelRequestModel.getDetailById(req.params.id);
          const updatedVehicleRequestDetail = await vehicleRequestModel.getDetailById(vehicleReq.id);
          await workflowNotificationService.notifyVehicleDecision(
            updatedVehicleRequestDetail,
            'อนุมัติ',
            getActorName(req.session?.user)
          );
          await workflowNotificationService.notifyVehicleAssigned(
            updatedVehicleRequestDetail,
            getActorName(req.session?.user)
          );
        }
      } catch (vehicleError) {
        console.error('Error assigning vehicle after approving travel:', vehicleError);
      }
    }

    res.redirect(`/vehicle-approval/travel/${req.params.id}`);
  } catch (error) {
    console.error('Error approving travel request:', error);
    res.status(500).send('ไม่สามารถอนุมัติคำขอไปราชการได้');
  }
};

exports.rejectTravel = async (req, res) => {
  try {
    await officialTravelRequestModel.reject(req.params.id, req.session?.user, req.body.approval_comment);
    await gitgumTravelSyncService.removeTravel(req.params.id);
    const item = await officialTravelRequestModel.getDetailById(req.params.id);
    if (item) {
      await workflowNotificationService.notifyTravelDecision(
        item,
        'ไม่อนุมัติ',
        req.session?.user?.fullname || req.session?.user?.username || 'system'
      );
    }
    res.redirect(`/vehicle-approval/travel/${req.params.id}`);
  } catch (error) {
    console.error('Error rejecting travel request:', error);
    res.status(500).send('ไม่สามารถไม่อนุมัติคำขอไปราชการได้');
  }
};

exports.vehicleDetail = async (req, res) => {
  try {
    const item = await vehicleRequestModel.getDetailById(req.params.id);

    if (!item) {
      return res.status(404).send('ไม่พบคำขอใช้รถราชการ');
    }

    await renderVehicleDetail(res, item);
  } catch (error) {
    console.error('Error loading vehicle approval detail:', error);
    res.status(500).send('ไม่สามารถโหลดคำขอใช้รถราชการได้');
  }
};

exports.approveVehicle = async (req, res) => {
  try {
    const [item, vehicles, drivers] = await Promise.all([
      vehicleRequestModel.getDetailById(req.params.id),
      vehicleMasterModel.listActive(),
      driverMasterModel.listActive()
    ]);
    if (!item) {
      return res.status(404).send('ไม่พบคำขอใช้รถราชการ');
    }
    if (item.travel_status !== 'approved') {
      return res.status(400).send('ต้องอนุมัติคำขอไปราชการก่อนจึงจะอนุมัติคำขอใช้รถได้');
    }

    const selectedVehicle = vehicles.find((vehicle) => Number(vehicle.id) === Number(req.body.vehicle_id));
    const selectedDriver = drivers.find((driver) => Number(driver.id) === Number(req.body.driver_id));

    if (!selectedVehicle || !selectedDriver) {
      return renderVehicleDetail(res.status(400), item, {
        vehicles,
        drivers,
        error: 'กรุณาเลือกรถและคนขับก่อนอนุมัติคำขอใช้รถ',
        assignmentSelection: buildAssignmentSelection(item, req.body)
      });
    }

    const overlapping = await vehicleAssignmentModel.findOverlappingAssignment(
      selectedVehicle.id,
      item.trip_start_at,
      item.trip_end_at,
      item.id
    );

    if (overlapping) {
      return renderVehicleDetail(res.status(400), item, {
        vehicles,
        drivers,
        error: `รถ ${selectedVehicle.plate_no} ถูกมอบหมายทับช่วงเวลาให้คำขอ ${overlapping.vehicle_request_no} แล้ว`,
        assignmentSelection: buildAssignmentSelection(item, req.body)
      });
    }

    await vehicleRequestModel.approve(req.params.id, req.session?.user, req.body.approval_comment);
    await vehicleAssignmentModel.upsertAssignment({
      vehicle_request_id: item.id,
      vehicle_id: selectedVehicle.id,
      driver_id: selectedDriver.id,
      assigned_by_member_id: req.session?.user?.id || null,
      assignment_note: req.body.assignment_note || null,
      plate_no_snapshot: selectedVehicle.plate_no,
      driver_name_snapshot: selectedDriver.driver_name,
      updated_by: getActorName(req.session?.user)
    });

    const updatedItem = await vehicleRequestModel.getDetailById(req.params.id);
    if (updatedItem) {
      const updatedTravelItem = await officialTravelRequestModel.getDetailById(updatedItem.travel_request_id);
      await gitgumTravelSyncService.syncApprovedTravel(updatedTravelItem);
      await workflowNotificationService.notifyVehicleDecision(
        updatedItem,
        'อนุมัติ',
        getActorName(req.session?.user)
      );
      await workflowNotificationService.notifyVehicleAssigned(
        updatedItem,
        getActorName(req.session?.user)
      );
    }
    res.redirect(`/vehicle-approval/request/${req.params.id}`);
  } catch (error) {
    console.error('Error approving vehicle request:', error);
    res.status(500).send('ไม่สามารถอนุมัติคำขอใช้รถได้');
  }
};

exports.rejectVehicle = async (req, res) => {
  try {
    await vehicleRequestModel.reject(req.params.id, req.session?.user, req.body.approval_comment);
    const item = await vehicleRequestModel.getDetailById(req.params.id);
    if (item) {
      const updatedTravelItem = await officialTravelRequestModel.getDetailById(item.travel_request_id);
      await gitgumTravelSyncService.syncApprovedTravel(updatedTravelItem);
      await workflowNotificationService.notifyVehicleDecision(
        item,
        'ไม่อนุมัติ',
        req.session?.user?.fullname || req.session?.user?.username || 'system'
      );
    }
    res.redirect(`/vehicle-approval/request/${req.params.id}`);
  } catch (error) {
    console.error('Error rejecting vehicle request:', error);
    res.status(500).send('ไม่สามารถไม่อนุมัติคำขอใช้รถได้');
  }
};

exports.assignVehicle = async (req, res) => {
  try {
    const [item, vehicles, drivers] = await Promise.all([
      vehicleRequestModel.getDetailById(req.params.id),
      vehicleMasterModel.listActive(),
      driverMasterModel.listActive()
    ]);

    if (!item) {
      return res.status(404).send('ไม่พบคำขอใช้รถราชการ');
    }

    if (item.status !== 'approved' && item.status !== 'assigned') {
      return res.status(400).send('ต้องอนุมัติคำขอใช้รถก่อนจึงจะมอบหมายรถและคนขับได้');
    }

    const selectedVehicle = vehicles.find((vehicle) => Number(vehicle.id) === Number(req.body.vehicle_id));
    const selectedDriver = drivers.find((driver) => Number(driver.id) === Number(req.body.driver_id));

    if (!selectedVehicle || !selectedDriver) {
      return renderVehicleDetail(res.status(400), item, {
        vehicles,
        drivers,
        error: 'กรุณาเลือกรถและคนขับให้ครบถ้วน',
        assignmentSelection: buildAssignmentSelection(item, req.body)
      });
    }

    const overlapping = await vehicleAssignmentModel.findOverlappingAssignment(
      selectedVehicle.id,
      item.trip_start_at,
      item.trip_end_at,
      item.id
    );

    if (overlapping) {
      return renderVehicleDetail(res.status(400), item, {
        vehicles,
        drivers,
        error: `รถ ${selectedVehicle.plate_no} ถูกมอบหมายทับช่วงเวลาให้คำขอ ${overlapping.vehicle_request_no} แล้ว`,
        assignmentSelection: buildAssignmentSelection(item, req.body)
      });
    }

    await vehicleAssignmentModel.upsertAssignment({
      vehicle_request_id: item.id,
      vehicle_id: selectedVehicle.id,
      driver_id: selectedDriver.id,
      assigned_by_member_id: req.session?.user?.id || null,
      assignment_note: req.body.assignment_note || null,
      plate_no_snapshot: selectedVehicle.plate_no,
      driver_name_snapshot: selectedDriver.driver_name,
      updated_by: getActorName(req.session?.user)
    });

    const updatedItem = await vehicleRequestModel.getDetailById(req.params.id);
    if (updatedItem) {
      const updatedTravelItem = await officialTravelRequestModel.getDetailById(updatedItem.travel_request_id);
      await gitgumTravelSyncService.syncApprovedTravel(updatedTravelItem);
      await workflowNotificationService.notifyVehicleAssigned(
        updatedItem,
        getActorName(req.session?.user)
      );
    }

    res.redirect(`/vehicle-approval/request/${req.params.id}`);
  } catch (error) {
    console.error('Error assigning vehicle request:', error);
    res.status(500).send('ไม่สามารถมอบหมายรถและคนขับได้');
  }
};