// SUPABASE UPLOAD DIAGNOSTIC SCRIPT
// Run this in your browser console to diagnose upload issues

/* eslint-disable no-undef, no-unused-vars */

(async function diagnosticCheck() {
  console.log('🔍 Starting Supabase Upload Diagnostic...\n');
  
  // Check 1: Supabase client exists
  console.log('1️⃣ Checking Supabase client...');
  if (typeof supabase === 'undefined') {
    console.error('❌ Supabase client not found. Make sure you\'re running this on the app page.');
    return;
  }
  console.log('✅ Supabase client found');
  
  // Check 2: Authentication
  console.log('\n2️⃣ Checking authentication...');
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError) {
    console.error('❌ Error fetching user:', userError);
    return;
  }
  
  if (!user) {
    console.error('❌ No user logged in. Please sign in first.');
    console.log('💡 Click the "Sign In" button in the app header');
    return;
  }
  
  console.log('✅ User authenticated');
  console.log('   User ID:', user.id);
  console.log('   Email:', user.email);
  
  // Check 3: Bucket exists
  console.log('\n3️⃣ Checking if "resumes" bucket exists...');
  try {
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError);
    } else {
      const resumesBucket = buckets.find(b => b.name === 'resumes');
      if (resumesBucket) {
        console.log('✅ "resumes" bucket exists');
        console.log('   Bucket config:', resumesBucket);
      } else {
        console.error('❌ "resumes" bucket NOT found');
        console.log('   Available buckets:', buckets.map(b => b.name).join(', '));
        console.log('\n💡 Fix: Create a bucket named "resumes" in Supabase Dashboard');
        console.log('   Go to: Storage → New bucket → Name: "resumes" → Make it private');
        return;
      }
    }
  } catch (err) {
    console.warn('⚠️ Could not check buckets (might need service role key)');
  }
  
  // Check 4: Test upload
  console.log('\n4️⃣ Testing upload permissions...');
  const testContent = 'Test upload at ' + new Date().toISOString();
  const testBlob = new Blob([testContent], { type: 'text/plain' });
  const testFileName = `test-${Date.now()}.txt`;
  const testPath = `${user.id}/resumes/${testFileName}`;
  
  console.log('   Attempting upload to:', testPath);
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('resumes')
    .upload(testPath, testBlob, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'text/plain'
    });
  
  if (uploadError) {
    console.error('❌ Upload failed:', uploadError);
    console.log('\n📋 Error Details:');
    console.log('   Status:', uploadError.statusCode || uploadError.status);
    console.log('   Message:', uploadError.message);
    
    if (uploadError.statusCode === 400 || uploadError.status === 400) {
      console.log('\n💡 Common 400 Error Fixes:');
      console.log('   1. Missing RLS policies - Add INSERT policy for authenticated users');
      console.log('   2. Bucket configuration - Check MIME types and file size limits');
      console.log('   3. Invalid path - Verify path format matches RLS policy rules');
      console.log('\n   Go to Supabase Dashboard → Storage → resumes → Policies');
      console.log('   Add this policy:\n');
      console.log('   CREATE POLICY "Allow uploads" ON storage.objects');
      console.log('   FOR INSERT TO authenticated');
      console.log('   WITH CHECK (');
      console.log('     bucket_id = \'resumes\' AND');
      console.log('     auth.uid()::text = split_part(name, \'/\', 1)');
      console.log('   );');
    }
    
    if (uploadError.statusCode === 403 || uploadError.status === 403) {
      console.log('\n💡 403 Forbidden Fix:');
      console.log('   Add RLS policies to allow authenticated users to upload');
    }
    
    return;
  }
  
  console.log('✅ Upload successful!');
  console.log('   File path:', uploadData.path);
  
  // Check 5: Test download
  console.log('\n5️⃣ Testing download permissions...');
  const { data: downloadData, error: downloadError } = await supabase.storage
    .from('resumes')
    .download(testPath);
  
  if (downloadError) {
    console.error('❌ Download failed:', downloadError);
    console.log('\n💡 Add SELECT policy for authenticated users');
    return;
  }
  
  console.log('✅ Download successful');
  
  // Clean up test file
  console.log('\n6️⃣ Cleaning up test file...');
  const { error: deleteError } = await supabase.storage
    .from('resumes')
    .remove([testPath]);
  
  if (deleteError) {
    console.warn('⚠️ Could not delete test file:', deleteError);
  } else {
    console.log('✅ Test file deleted');
  }
  
  console.log('\n✨ All checks passed! Your Supabase storage is configured correctly.');
  console.log('   You should be able to upload resumes now.');
  
})();
