import { DataSource } from 'typeorm';

export async function seedDatabase(dataSource: DataSource) {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    // Seed drivers
    await queryRunner.query(`
      INSERT INTO drivers (first_name, last_name, email, phone, status)
      VALUES
        ('John', 'Doe', 'john.doe@example.com', '+1234567890', 'available'),
        ('Jane', 'Smith', 'jane.smith@example.com', '+1234567891', 'available'),
        ('Mike', 'Johnson', 'mike.johnson@example.com', '+1234567892', 'on_route')
      ON CONFLICT (email) DO NOTHING
    `);

    // Seed vehicles
    await queryRunner.query(`
      INSERT INTO vehicles (make, model, year, license_plate, capacity, status)
      VALUES
        ('Ford', 'Transit', 2022, 'ABC-1234', 1500, 'available'),
        ('Mercedes', 'Sprinter', 2023, 'XYZ-5678', 2000, 'available'),
        ('Chevrolet', 'Express', 2021, 'DEF-9012', 1800, 'in_use')
      ON CONFLICT (license_plate) DO NOTHING
    `);

    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await queryRunner.release();
  }
}
