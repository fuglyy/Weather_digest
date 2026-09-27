import Site from './site.model.js';
import Equipment from './equipment.model.js';
import EquipmentPassport from './equipmentPassport.model.js';
import MaintenanceRequest from './maintenanceRequest.model.js';
import RequestStatusHistory from './requestStatusHistory.model.js';
import Technician from './technician.model.js';
import RequestAssignee from './requestAssignee.model.js';

Site.hasMany(Equipment, { foreignKey: 'siteId', as: 'equipment' });
Equipment.belongsTo(Site, { foreignKey: 'siteId', as: 'site' });

Equipment.hasOne(EquipmentPassport, { foreignKey: 'equipmentId', as: 'passport' });
EquipmentPassport.belongsTo(Equipment, { foreignKey: 'equipmentId', as: 'equipment' });

Equipment.hasMany(MaintenanceRequest, { foreignKey: 'equipmentId', as: 'requests' });
MaintenanceRequest.belongsTo(Equipment, { foreignKey: 'equipmentId', as: 'equipment' });

MaintenanceRequest.hasMany(RequestStatusHistory, { foreignKey: 'requestId', as: 'statusHistory' });
RequestStatusHistory.belongsTo(MaintenanceRequest, { foreignKey: 'requestId', as: 'request' });

Technician.belongsToMany(MaintenanceRequest, {
  through: RequestAssignee,
  foreignKey: 'technicianId',
  otherKey: 'requestId',
  as: 'requests',
});

MaintenanceRequest.belongsToMany(Technician, {
  through: RequestAssignee,
  foreignKey: 'requestId',
  otherKey: 'technicianId',
  as: 'assignedTechnicians',
});

RequestAssignee.belongsTo(MaintenanceRequest, { foreignKey: 'requestId', as: 'request' });
RequestAssignee.belongsTo(Technician, { foreignKey: 'technicianId', as: 'technician' });

export {
  Site,
  Equipment,
  EquipmentPassport,
  MaintenanceRequest,
  RequestStatusHistory,
  Technician,
  RequestAssignee,
};

export default {
  Site,
  Equipment,
  EquipmentPassport,
  MaintenanceRequest,
  RequestStatusHistory,
  Technician,
  RequestAssignee,
};
