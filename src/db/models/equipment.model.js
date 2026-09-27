import { DataTypes } from 'sequelize';

import { sequelize } from '../index.js';

export const Equipment = sequelize.define(
  'Equipment',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    siteId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'site_id',
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    serialNumber: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'serial_number',
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'operational',
    },
    installedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'installed_at',
    },
  },
  {
    tableName: 'equipment',
    timestamps: false,
  },
);

export default Equipment;
