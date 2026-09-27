import { DataTypes } from 'sequelize';

import { sequelize } from '../index.js';

export const Technician = sequelize.define(
  'Technician',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fullName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: 'full_name',
    },
    specialization: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    personnelNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: 'personnel_number',
    },
  },
  {
    tableName: 'technicians',
    timestamps: false,
  },
);

export default Technician;
