import { DataTypes } from 'sequelize';

import { sequelize } from '../index.js';

export const EquipmentPassport = sequelize.define(
  'EquipmentPassport',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    equipmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'equipment_id',
    },
    manufacturer: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    model: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    ratedPower: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'rated_power',
    },
    lastCalibrationAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'last_calibration_at',
    },
  },
  {
    tableName: 'equipment_passports',
    timestamps: false,
  },
);

export default EquipmentPassport;
