export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('request_status_history', {
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
      onDelete: 'RESTRICT',
    },
    old_status: {
      type: Sequelize.STRING(30),
      allowNull: false,
    },
    new_status: {
      type: Sequelize.STRING(30),
      allowNull: false,
    },
    changed_by: {
      type: Sequelize.STRING(100),
      allowNull: false,
    },
    comment: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn('NOW'),
    },
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('request_status_history');
}
