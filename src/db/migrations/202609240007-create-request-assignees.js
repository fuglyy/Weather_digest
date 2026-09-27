export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('request_assignees', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    request_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'maintenance_requests',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    technician_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'technicians',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    role: {
      type: Sequelize.STRING(20),
      allowNull: false,
    },
    hours: {
      type: Sequelize.DECIMAL(6, 2),
      allowNull: false,
    },
  });

  await queryInterface.addIndex('request_assignees', ['request_id', 'technician_id'], {
    unique: true,
    name: 'request_assignees_unique_request_tech',
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('request_assignees');
}
