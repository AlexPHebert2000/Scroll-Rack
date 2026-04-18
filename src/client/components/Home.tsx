import React from "react";
import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

const Home = () :ReactElement => {
  const navigate = useNavigate();
  const checkSession = async () => {
    return await axios.get('/api/user/me');
  }

  const q = useQuery({queryKey: ['sessionLookup'], queryFn: checkSession})
  const user : {username: string, decks: {name: string, id: string}[]} = q.data?.data.user

  const handleClickDeck = (e : React.MouseEvent, id : string) => {
    navigate(`/deck/${id}`);
  }

  if (q.isError) {
    return (
      <>
        <p>Please <Link to="/login">log in</Link> to view your decklists.</p>
      </>
    );
  }

  return (
    <>
      Welcome Home
      <hr/>
      {user && user.decks ? user.decks.map(({name, id}, index) => <a onClick={(e) => handleClickDeck(e, id)} key={id}>{name}</a>) : <>No decks</>}
    </>
  )
}

export default Home;