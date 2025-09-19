const memberModel = require('../models/memberModel');

exports.listMembers = async (req, res) => {
  try {
    const members = await memberModel.getAllMembers();
    if (!members || members.length === 0) {
      console.warn('No members found'); // Log a warning if no members are found
    }
    res.render('members/list', { members: members || [] }); // Ensure members is an array
  } catch (error) {
    console.error('Error in listMembers controller:', error); // Log the error
    res.status(500).send('Error fetching members');
  }
};

exports.createMember = async (req, res) => {
  if (req.method === 'GET') {
    res.render('members/create');
  } else if (req.method === 'POST') {
    const { username, fullname, position, group, m_class } = req.body;
    try {
      await memberModel.addMember({ username, fullname, position, group, m_class });
      res.redirect('/member');
    } catch (error) {
      console.error(error);
      res.status(500).send('Error creating member');
    }
  }
};

exports.editMember = async (req, res) => {
  const { id } = req.params;
  if (req.method === 'GET') {
    try {
      const member = await memberModel.getMemberById(id);
      res.render('members/edit', { member });
    } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching member');
    }
  } else if (req.method === 'POST') {
    const { username, fullname, position, group, m_class } = req.body;
    try {
      await memberModel.updateMember(id, { username, fullname, position, group, m_class });
      res.redirect('/member');
    } catch (error) {
      console.error(error);
      res.status(500).send('Error updating member');
    }
  }
};

exports.deleteMember = async (req, res) => {
  const { id } = req.params;
  try {
    await memberModel.deleteMember(id);
    res.redirect('/member');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error deleting member');
  }
};

exports.editMemberPage = async (req, res) => {
  try {
    const memberId = req.params.id; // Get member ID from the route parameter
    const [member] = await memberModel.getMemberById(memberId); // Fetch member by ID

    if (!member) {
      return res.status(404).send('Member not found'); // Handle case where member doesn't exist
    }

    res.render('members/edit', { member }); // Pass the member object to the view
  } catch (error) {
    console.error('Error fetching member:', error);
    res.status(500).send('Internal Server Error');
  }
};

exports.updateMemberStatus = async (req, res) => {
  const { id } = req.params;
  const { m_status } = req.body;

  try {
    if (m_status !== 'active' && m_status !== 'ban') {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    await memberModel.updateMemberStatus(id, m_status);
    res.status(200).json({ message: 'Status updated successfully' });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ message: 'Failed to update status' });
  }
};
