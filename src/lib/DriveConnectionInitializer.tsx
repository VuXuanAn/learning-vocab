import { useEffect } from 'react'
import { useAuth } from './AuthProvider'
import { useDriveConnection } from './drive-connection'
export default function DriveConnectionInitializer(){
 const { session, loading }=useAuth()
 const userId=session?.user.id??'',token=session?.provider_token??''
 useEffect(()=>{
  if(loading)return
  if(!userId){useDriveConnection.getState().reset();return}
  void useDriveConnection.getState().initialize(userId,token)
 },[userId,token,loading])
 return null
}
