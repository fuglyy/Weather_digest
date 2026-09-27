import { DataTypes } from 'sequelize';

import { sequelize } from '../index.js';

export const RequestAssignee = sequelize.define(
  'RequestAssignee',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    requestId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'request_id',
    },
    technicianId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'technician_id',
    },
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['lead', 'member']],
      },
    },
    hours: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
  },
  {
    tableName: 'request_assignees',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['request_id', 'technician_id'],
      },
    ],
  },
);

export default RequestAssignee;
