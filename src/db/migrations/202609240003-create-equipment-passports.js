export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('equipment_passports', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    equipment_id: {
      type: Sequelize.UUID,
      allowNull: false,
      unique: true,
      references: {
        model: 'equipment',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    manufacturer: {
      type: Sequelize.STRING(100),
      allowNull: false,
    },
    model: {
      type: Sequelize.STRING(100),
      allowNull: false,
    },
    rated_power: {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
    },
    last_calibration_at: {
      type: Sequelize.DATE,
      allowNull: false,
    },
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('equipment_passports');
}
