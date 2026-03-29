import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export async function seedAdmin() {
  await connectDB();
  const existing = await User.findOne({ email: 'admin@eventvista.com' });
  if (!existing) {
    const hash = await bcrypt.hash('Admin@2026!', 10);
    await User.create({
      name: 'Admin',
      email: 'admin@eventvista.com',
      password: hash,
      agencyName: 'EventVista',
      role: 'admin',
    });
    console.log('Admin account created');
  }
}
