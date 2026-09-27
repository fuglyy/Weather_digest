export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('equipment', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    site_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'sites',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    name: {
      type: Sequelize.STRING(150),
      allowNull: false,
    },
    type: {
      type: Sequelize.STRING(50),
      allowNull: false,
    },
    serial_number: {
      type: Sequelize.STRING(100),
      allowNull: false,
      unique: true,
    },
    status: {
      type: Sequelize.STRING(30),
      allowNull: false,
      defaultValue: 'operational',
    },
    installed_at: {
      type: Sequelize.DATE,
      allowNull: false,
    },
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('equipment');
}
