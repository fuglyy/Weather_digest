import { DataTypes } from 'sequelize';

import { sequelize } from '../index.js';

export const RequestStatusHistory = sequelize.define(
  'RequestStatusHistory',
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
    oldStatus: {
      type: DataTypes.STRING(30),
      allowNull: false,
      field: 'old_status',
    },
    newStatus: {
      type: DataTypes.STRING(30),
      allowNull: false,
      field: 'new_status',
    },
    changedBy: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'changed_by',
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
  },
  {
    tableName: 'request_status_history',
    timestamps: false,
  },
);

export default RequestStatusHistory;
